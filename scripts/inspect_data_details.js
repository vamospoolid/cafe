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
echo "=== IN poscafe_standalone_db ==="
sudo -u postgres psql -d poscafe_standalone_db << 'EOF'
SELECT id, name, "tenantId", price, stock FROM "Product";
SELECT id, name, "tenantId", stock, unit FROM "Ingredient";
SELECT id, "orderNo", "totalAmount", status, "tenantId", "createdAt" FROM "Order" ORDER BY "createdAt" DESC LIMIT 5;
EOF

echo "=== IN poscafe_db ==="
sudo -u postgres psql -d poscafe_db << 'EOF'
SELECT id, name, "tenantId", price, stock FROM "Product" WHERE "tenantId" IN ('tenant-vamos-pool', 'tenant-default-muki');
SELECT id, name, "tenantId", stock, unit FROM "Ingredient" WHERE "tenantId" IN ('tenant-vamos-pool', 'tenant-default-muki');
SELECT id, "orderNo", "totalAmount", status, "tenantId", "createdAt" FROM "Order" WHERE "tenantId" IN ('tenant-vamos-pool', 'tenant-default-muki') ORDER BY "createdAt" DESC LIMIT 5;
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
