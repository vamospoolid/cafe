const { Client } = require('ssh2');

const sshConfig = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  const query = `
  cd /var/www/poscafe/backend
  node -e "
  require('dotenv').config();
  const http = require('http');
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET;
  console.log('SECRET FOUND:', !!secret);
  const token = jwt.sign({ id: 11, username: 'admin', role: 'Admin' }, secret);
  
  const s = '2026-09-14';
  const e = '2026-09-14';
  const path = '/api/ingredients/analytics/daily-usage?startDate=' + s + 'T00:00:00.000Z&endDate=' + e + 'T23:59:59.999Z&category=ALL&type=ALL';
  
  const req = http.request({
    host: 'localhost',
    port: 5000,
    path,
    headers: {
      'Authorization': 'Bearer ' + token
    }
  }, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('RESPONSE:', data));
  });
  req.end();
  "
  `;
  conn.exec(query, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect(sshConfig);
