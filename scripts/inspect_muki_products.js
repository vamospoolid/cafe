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
SELECT id, name, "sellPrice", "tenantId" FROM "Product" WHERE "tenantId" IN ('tenant-vamos-pool', 'tenant-default-muki');
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
