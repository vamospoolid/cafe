const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
sudo -u postgres psql -d poscafe_standalone_db << 'EOF'
SELECT "tenantId", count(*) as total_products FROM "Product" GROUP BY "tenantId";
SELECT "tenantId", count(*) as total_ingredients FROM "Ingredient" GROUP BY "tenantId";
SELECT "tenantId", count(*) as total_recipes FROM "RecipeItem" GROUP BY "tenantId";
SELECT id, name, "sellPrice", "tenantId" FROM "Product" WHERE "tenantId" = 'tenant-vamos-pool' LIMIT 10;
SELECT * FROM "Settings" WHERE "tenantId" = 'tenant-vamos-pool';
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
