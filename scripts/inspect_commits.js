const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  const cmd = [
    'echo "=== /var/www/poscafe commit ==="',
    'cd /var/www/poscafe && git log -n 3 --oneline',
    'echo "=== /var/www/codenusa commit ==="',
    'cd /var/www/codenusa && git log -n 3 --oneline',
    'echo "=== /etc/nginx/sites-available/app.mukiramen.id ==="',
    'cat /etc/nginx/sites-available/app.mukiramen.id'
  ].join(' && ');

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect(config);
