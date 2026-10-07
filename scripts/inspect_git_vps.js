const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  const q = `
echo "=== 1. GIT STATUS /var/www/poscafe (Muki Ramen) ==="
cd /var/www/poscafe
git status
git log -n 3 --oneline

echo "=== 2. GIT STATUS /var/www/codenusa (CodePOS SaaS) ==="
cd /var/www/codenusa
git status
git log -n 3 --oneline
`;

  conn.exec(q, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect(config);
