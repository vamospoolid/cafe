const { Client } = require('ssh2');

const VPS_CONFIG = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07',
  readyTimeout: 30000
};

const sql = `
SELECT id, "orderNumber", "tenantId", "status", "paymentMethod", "total", "createdAt", "paidAt" 
FROM "Order" 
WHERE id = 173;

SELECT * FROM "OrderItem" WHERE "orderId" = 173;
`.trim();

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createWriteStream('/tmp/order173.sql');
    stream.on('close', () => {
      conn.exec('sudo -u postgres psql -d poscafe_db -f /tmp/order173.sql && rm -f /tmp/order173.sql', (err, execStream) => {
        if (err) throw err;
        execStream.on('data', d => process.stdout.write(d));
        execStream.stderr.on('data', d => process.stderr.write(d));
        execStream.on('close', code => {
          conn.end();
        });
      });
    });
    stream.end(sql);
  });
}).on('error', err => console.error(err)).connect(VPS_CONFIG);
