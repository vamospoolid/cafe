const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('ps aux | grep -E "build|tsc|vite|node"', (err, stream) => {
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
