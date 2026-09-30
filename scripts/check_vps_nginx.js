const { Client } = require('ssh2');
const config = { host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07', readyTimeout: 15000 };
const conn = new Client();
conn.on('ready', () => {
  const sql = `SELECT id, key, name, "isCore" FROM "Feature";`;
  conn.exec(`sudo -u postgres psql -d poscafe_db -c '${sql}'`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect(config);
