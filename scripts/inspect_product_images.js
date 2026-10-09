const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const sql = `SELECT id, name, "imageUrl" FROM "Product" WHERE "deletedAt" IS NULL ORDER BY id ASC;`;
  const cmd = `sudo -u postgres psql -d mukiramen_db -c '${sql}'`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
});
