const { Client } = require('ssh2');
const config = { host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07' };
const conn = new Client();
conn.on('ready', () => {
  conn.exec('certbot --nginx -d cafe.codenusa.id --non-interactive --agree-tos --register-unsafely-without-email && nginx -t && systemctl reload nginx', (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect(config);
