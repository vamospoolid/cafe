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
    'pm2 list',
    'echo "=== DATABASES ==="',
    'sudo -u postgres psql -c "\\l"',
    'echo "=== NGINX SITES ==="',
    'ls -la /etc/nginx/sites-enabled/',
    'echo "=== POSCAFE ENV ==="',
    'cat /var/www/poscafe/backend/.env',
    'echo "=== GIT STATUS /var/www/poscafe ==="',
    'cd /var/www/poscafe && git status && git remote -v'
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
