const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = [
    'ls -la /var/www/poscafe/backend/uploads/tenants 2>/dev/null',
    'find /var/www/poscafe/backend/uploads -name "*.webp" 2>/dev/null',
    'ls -la /var/www/codenusa/backend/uploads/tenants/tenant-default-muki 2>/dev/null',
    'find /var/www -name "*7760797f*" 2>/dev/null'
  ].join(' && echo "---" && ');

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
});
