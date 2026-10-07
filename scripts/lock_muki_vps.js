const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  const lockScript = `
set -e
echo "=== 1. Adding lock notice in /var/www/poscafe ==="
cat << 'EOF' > /var/www/poscafe/STANDALONE_MUKIRAMEN_DO_NOT_TOUCH.txt
========================================================================
PERINGATAN: INSTANCE STANDALONE MUKI RAMEN (KLIEN AKTIF)
DATABASE: mukiramen_db (PORT 5000 / PM2: poscafe-backend)
DOMAINS: app.mukiramen.id & staff.mukiramen.id

DIREKTORI INI SUDAH DIKUNCI DAN TERISOLASI 100%.
JANGAN MELAKUKAN GIT PULL, PRISMA DB PUSH, ATAU UPGRADE CODEPOS SAAS DI SINI!
SEMUA UPGRADE SAAS DILAKUKAN DI: /var/www/codenusa (PORT 5001 / codenusa_db)
========================================================================
EOF

echo "=== 2. Changing git remote in /var/www/poscafe to prevent accidental git pull ==="
cd /var/www/poscafe
git remote rename origin origin-frozen || true
git config remote.origin-frozen.pushurl "DISABLED"
git config branch.main.remote "origin-frozen"

echo "=== 3. Git remote status in /var/www/poscafe ==="
git remote -v
`;

  conn.exec(lockScript, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect(config);
