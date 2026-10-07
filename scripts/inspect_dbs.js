const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  const cmd = [
    'echo "=== TABLES AND TENANTS IN poscafe_standalone_db ==="',
    'sudo -u postgres psql -d poscafe_standalone_db -c \'SELECT id, name, slug, "customDomain" FROM "Tenant";\'',
    'sudo -u postgres psql -d poscafe_standalone_db -c \'SELECT id, username, role, "tenantId" FROM "User";\'',
    'echo "=== TABLES AND TENANTS IN poscafe_db ==="',
    'sudo -u postgres psql -d poscafe_db -c \'SELECT id, name, slug, "customDomain" FROM "Tenant";\''
  ].join(' && ');

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect(config);
