const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec("node -e \"const fs = require('fs'); const t = fs.readFileSync('/var/www/poscafe/frontend/dist/assets/index-DDOJA2Ne.js', 'utf8'); const idx = t.indexOf('Cari nama, WA'); console.log('Index:', idx); if (idx !== -1) console.log(t.substring(idx - 200, idx + 400));\"", (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      console.log('OUTPUT:\n', out);
      conn.end();
    });
  });
}).connect({ host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07' });
