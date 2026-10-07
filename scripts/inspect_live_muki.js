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
SELECT id, name, slug, "customDomain" FROM "Tenant";
SELECT id, username, role, "tenantId" FROM "User";
SELECT id, name, "sellPrice", stock, "tenantId" FROM "Product" LIMIT 10;
SELECT id, "orderNumber", total, status, "tenantId", "createdAt" FROM "Order" ORDER BY "createdAt" DESC LIMIT 10;
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
