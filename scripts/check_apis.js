const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('curl -s "http://localhost:5000/api/ingredients/analytics/daily-usage?startDate=2026-09-29&endDate=2026-09-29"', (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      console.log('Daily usage:', out);
      conn.exec('curl -s "http://localhost:5000/api/ingredients/stock-movements?limit=10"', (err2, stream2) => {
        let out2 = '';
        stream2.on('data', d => out2 += d);
        stream2.on('close', () => {
          console.log('Stock movements:', out2);
          conn.end();
        });
      });
    });
  });
}).connect({ host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07' });
