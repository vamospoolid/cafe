const { Client } = require('ssh2');

const VPS = { host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07', readyTimeout: 15000 };

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected');
  conn.exec('cat /var/www/poscafe/deploy_frontend_quick.js 2>&1', (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += d);
    stream.on('close', () => {
      console.log('deploy_frontend_quick.js:\n', out);
      conn.end();
    });
  });
}).on('error', err => console.error('SSH error:', err)).connect(VPS);
