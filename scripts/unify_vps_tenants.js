const { Client } = require('ssh2');

const VPS_CONFIG = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07',
  readyTimeout: 30000
};

const sql = `
UPDATE "Product" SET "tenantId" = 'tenant-vamos-pool';
UPDATE "Category" SET "tenantId" = 'tenant-vamos-pool';
UPDATE "Ingredient" SET "tenantId" = 'tenant-vamos-pool';
UPDATE "RecipeItem" SET "tenantId" = 'tenant-vamos-pool';
UPDATE "Supplier" SET "tenantId" = 'tenant-vamos-pool';
SELECT count(*) as total_products FROM "Product" WHERE "tenantId" = 'tenant-vamos-pool';
SELECT count(*) as total_ingredients FROM "Ingredient" WHERE "tenantId" = 'tenant-vamos-pool';
`.trim();

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ Connected to VPS.');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createWriteStream('/tmp/unify_tenants.sql');
    stream.on('close', () => {
      conn.exec('sudo -u postgres psql -d poscafe_db -f /tmp/unify_tenants.sql && rm -f /tmp/unify_tenants.sql', (err, execStream) => {
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
