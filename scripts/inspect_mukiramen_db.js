const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  const q = `
echo "=== 1. MUKIRAMEN_DB DATA ==="
sudo -u postgres psql -d mukiramen_db << 'EOF'
\\dt
SELECT count(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public';
SELECT id, name, slug, "customDomain" FROM "Tenant";
SELECT id, username, role, "tenantId" FROM "User";
SELECT count(*) as total_orders FROM "Order";
SELECT count(*) as total_products FROM "Product";
EOF

echo "=== 2. POSCAFE_DB DATA (FOR COMPARISON) ==="
sudo -u postgres psql -d poscafe_db << 'EOF'
SELECT count(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public';
SELECT id, name, slug, "customDomain" FROM "Tenant";
SELECT count(*) as total_orders FROM "Order";
EOF
`;

  conn.exec(q, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect(config);
