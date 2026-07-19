const { Client } = require('ssh2');
const config = { host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07' };
const cmd = "cat /root/.pm2/logs/poscafe-backend-out.log /root/.pm2/logs/poscafe-backend-error.log | grep -A 20 -B 5 -i -E 'tables|offlineId|column'";
const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect(config);
