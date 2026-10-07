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
    'echo "=== CODENUSA ENV ==="',
    'cat /var/www/codenusa/backend/.env',
    'echo "=== GIT STATUS /var/www/codenusa ==="',
    'cd /var/www/codenusa && git remote -v && git branch'
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
