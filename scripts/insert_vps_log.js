const { Client } = require('ssh2');

const VPS_CONFIG = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07',
  readyTimeout: 30000
};

const sql = `
INSERT INTO "IngredientLog" ("ingredientId", "change", "cost", "type", "description", "referenceId", "createdAt", "tenantId")
VALUES 
  (5, -200, 26000, 'Produksi', 'Order ORD-20260929-008', 'ORD-20260929-008', '2026-09-29 00:41:42.373', 'tenant-vamos-pool'),
  (3, -200, 2800, 'Produksi', 'Order ORD-20260929-008', 'ORD-20260929-008', '2026-09-29 00:41:42.373', 'tenant-vamos-pool');

UPDATE "Ingredient" SET stock = stock - 200 WHERE id = 5;
UPDATE "Ingredient" SET stock = stock - 200 WHERE id = 3;

SELECT id, "ingredientId", "change", "cost", "type", "description", "referenceId", "createdAt" 
FROM "IngredientLog" 
WHERE "referenceId" = 'ORD-20260929-008';
`.trim();

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createWriteStream('/tmp/insert_log.sql');
    stream.on('close', () => {
      conn.exec('sudo -u postgres psql -d poscafe_db -f /tmp/insert_log.sql && rm -f /tmp/insert_log.sql', (err, execStream) => {
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
