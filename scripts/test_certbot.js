const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('certbot certonly --webroot -w /var/www/html -d codenusa.id -d www.codenusa.id -d mukiramen.codenusa.id -d tokoberkah.codenusa.id -d sabarjaya.codenusa.id -d laundry1.codenusa.id -d sewabajubodo.codenusa.id --expand --non-interactive --dry-run', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += d);
    stream.on('close', (code) => {
      console.log('EXIT CODE:', code);
      console.log('CERTBOT OUTPUT:\n' + out.trim());
      conn.end();
    });
  });
}).connect({
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07',
  readyTimeout: 30000
});
