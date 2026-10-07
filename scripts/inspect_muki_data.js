const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  const cmd = `sudo -u postgres psql -d poscafe_standalone_db << 'EOF'
SELECT count(*) as total_orders FROM "Order" WHERE "tenantId" = 'tenant-vamos-pool';
SELECT count(*) as total_products FROM "Product" WHERE "tenantId" = 'tenant-vamos-pool';
SELECT count(*) as total_ingredients FROM "Ingredient" WHERE "tenantId" = 'tenant-vamos-pool';
SELECT count(*) as total_recipes FROM "Recipe" WHERE "tenantId" = 'tenant-vamos-pool';
EOF
`;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect(config);
