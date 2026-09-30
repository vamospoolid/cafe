const { Client } = require('ssh2');

const VPS_CONFIG = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07',
  readyTimeout: 30000
};

const sql = `
UPDATE "Ingredient" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" IS NULL;
UPDATE "RecipeItem" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" IS NULL;
UPDATE "Category" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" IS NULL;
UPDATE "Product" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" IS NULL;
UPDATE "Supplier" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" IS NULL;
SELECT count(*) as total_ingredients, count("tenantId") as with_tenant FROM "Ingredient";
`.trim();

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ Connected to VPS.');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createWriteStream('/tmp/update_tenant.sql');
    stream.on('close', () => {
      console.log('Uploaded /tmp/update_tenant.sql');
      conn.exec('sudo -u postgres psql -d poscafe_db -f /tmp/update_tenant.sql && rm -f /tmp/update_tenant.sql', (err, execStream) => {
        if (err) throw err;
        execStream.on('data', d => process.stdout.write(d));
        execStream.stderr.on('data', d => process.stderr.write(d));
        execStream.on('close', code => {
          console.log(`Executed with code: ${code}`);
          conn.end();
        });
      });
    });
    stream.end(sql);
  });
}).on('error', err => console.error(err)).connect(VPS_CONFIG);
