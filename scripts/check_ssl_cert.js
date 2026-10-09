const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('openssl x509 -in /etc/letsencrypt/live/codenusa.id/fullchain.pem -noout -subject -ext subjectAltName', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      console.log('SSL CERT DETAILS:\n' + out.trim());
      conn.end();
    });
  });
}).connect({
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07',
  readyTimeout: 10000
});
