const { Client } = require('ssh2');
const config = { host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07', readyTimeout: 15000 };

// Pull latest code and rebuild frontend on VPS
const cmd = `cd /var/www/poscafe && git reset --hard HEAD && git pull origin main && cd frontend && npm run build && echo "=== DEPLOY DONE ==="`;

const conn = new Client();
conn.on('ready', () => {
  console.log('🔗 Connected to VPS. Starting deploy...\n');
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => {
      console.log(`\n✅ Deploy finished (exit code: ${code})`);
      conn.end();
    });
  });
}).on('error', err => console.error('❌ SSH error:', err.message)).connect(config);
